import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import { AppApkReleasesService } from "./app-apk-releases.service";
import { AppApkRelease } from "../../database/entities/app-apk-release.entity";

jest.mock("fs", () => ({ existsSync: jest.fn() }));

const sendMock = jest.fn().mockResolvedValue({});
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe("AppApkReleasesService", () => {
  let service: AppApkReleasesService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    sendMock.mockClear();
    (fs.existsSync as jest.Mock).mockReset();
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity) => ({ id: "apk-new", ...entity })),
      save: jest.fn(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppApkReleasesService,
        { provide: getRepositoryToken(AppApkRelease), useValue: repo },
      ],
    }).compile();

    service = module.get(AppApkReleasesService);
  });

  describe("getLatest", () => {
    it("returns the latest active release when its file exists (Object Storage URL, always trusted)", async () => {
      repo.findOne.mockResolvedValue({
        version_name: "1.2.0",
        apk_url: "https://x/app-releases/o.apk",
        checksum: "abc",
        notes: "fix",
      });

      const result = await service.getLatest("android");

      expect(result).toEqual({
        versionName: "1.2.0",
        url: "https://x/app-releases/o.apk",
        checksum: "abc",
        notes: "fix",
      });
    });

    it("returns null when no active release exists", async () => {
      repo.findOne.mockResolvedValue(null);

      expect(await service.getLatest("android")).toBeNull();
    });

    it("returns null for a legacy /uploads release whose file no longer exists on disk", async () => {
      repo.findOne.mockResolvedValue({
        version_name: "1.0.0",
        apk_url: "/uploads/apks/old.apk",
        checksum: "x",
        notes: null,
      });
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(await service.getLatest("android")).toBeNull();
    });

    it("returns the release when a legacy /uploads file still exists on disk", async () => {
      repo.findOne.mockResolvedValue({
        version_name: "1.0.0",
        apk_url: "/uploads/apks/old.apk",
        checksum: "x",
        notes: null,
      });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getLatest("android");

      expect(result?.versionName).toBe("1.0.0");
    });
  });

  describe("getDownloadUrl", () => {
    it("returns the latest release url when available", async () => {
      repo.findOne.mockResolvedValue({
        apk_url: "https://x/app-releases/o.apk",
      });

      expect(await service.getDownloadUrl("android")).toBe(
        "https://x/app-releases/o.apk",
      );
    });

    it("falls back to the hard-coded public URL when there is no active release", async () => {
      repo.findOne.mockResolvedValue(null);

      expect(await service.getDownloadUrl("android")).toBe(
        "https://obix-apk-download.vercel.app/obix.apk",
      );
    });

    it("falls back to the public URL when the only release is a missing legacy file", async () => {
      repo.findOne.mockResolvedValue({ apk_url: "/uploads/apks/gone.apk" });
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(await service.getDownloadUrl("android")).toBe(
        "https://obix-apk-download.vercel.app/obix.apk",
      );
    });
  });

  describe("list", () => {
    it("filters by platform when provided", async () => {
      await service.list("android");

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { platform: "android" } }),
      );
    });
  });

  describe("create", () => {
    it("uploads the apk and creates an active release", async () => {
      const file = {
        buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
        originalname: "app.apk",
        mimetype: "application/vnd.android.package-archive",
      };

      const result = await service.create(file, {
        platform: "android",
        versionName: "2.0.0",
      });

      expect(sendMock).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ version_name: "2.0.0", is_active: true }),
      );
      expect(result).toBeDefined();
    });

    it("throws BadRequestException when no file is provided", async () => {
      await expect(
        service.create(null, { platform: "android", versionName: "2.0.0" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when no versionName is provided", async () => {
      const file = {
        buffer: Buffer.from("x"),
        originalname: "app.apk",
        mimetype: "application/vnd.android.package-archive",
      };

      await expect(
        service.create(file, { platform: "android" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("setActive", () => {
    it("updates the release active flag", async () => {
      repo.findOne.mockResolvedValue({ id: "apk-1", is_active: true });

      const result = await service.setActive("apk-1", false);

      expect(result.is_active).toBe(false);
    });

    it("throws NotFoundException when the release does not exist", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.setActive("missing", true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

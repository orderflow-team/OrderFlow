import { parseQuantityUnit } from './apps/web/lib/parse-quantity-unit';

const normalize = (u: string) => {
  const lower = (u || '').toLowerCase();
  if (lower === 'gram' || lower === 'g' || lower === 'gm' || lower === 'gms') return 'g';
  if (lower === 'kg' || lower === 'kilo' || lower === 'kgs' || lower === 'kilogram') return 'kg';
  if (lower === 'litre' || lower === 'l' || lower === 'ltr' || lower === 'liters') return 'L';
  if (lower === 'ml' || lower === 'mls' || lower === 'millilitre') return 'ml';
  return lower;
};

const isMass = (u: string) => u === 'kg' || u === 'g';
const isVol = (u: string) => u === 'L' || u === 'ml';

function test(currentUnit: string, newUnit: string, newPrice: number) {
  const parsedCurrent = parseQuantityUnit(currentUnit) || { quantity: 1, unit: currentUnit };
  const parsedNew = parseQuantityUnit(newUnit) || { quantity: 1, unit: newUnit };

  const normCurrent = normalize(parsedCurrent.unit);
  const normNew = normalize(parsedNew.unit);

  if (normCurrent && normNew && ((isMass(normCurrent) && isMass(normNew)) || (isVol(normCurrent) && isVol(normNew)))) {
    let pricePerBasicUnit = newPrice / parsedCurrent.quantity;
    if (normCurrent === 'kg' || normCurrent === 'L') {
      pricePerBasicUnit = pricePerBasicUnit / 1000;
    }

    let finalPrice = pricePerBasicUnit * parsedNew.quantity;
    if (normNew === 'kg' || normNew === 'L') {
      finalPrice = finalPrice * 1000;
    }
    
    newPrice = finalPrice;
  }
  console.log(currentUnit, '->', newUnit, '=', newPrice);
}

test('350g', 'kg', 65);
test('350 g', 'kg', 65);
test('350g', '1kg', 65);
test('g', 'kg', 0.1857);

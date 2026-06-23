'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  // Mock Data
  const stats = [
    { title: 'Total Revenue', value: '$45,231.89', change: '+20.1%', positive: true, icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { title: 'Orders', value: '+2350', change: '+18.2%', positive: true, icon: 'M9 5l7 7-7 7' }, // Shopping cart simplified
    { title: 'Active Customers', value: '+12,234', change: '+19.0%', positive: true, icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { title: 'Pending Shipments', value: '43', change: '-4.2%', positive: false, icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }
  ];

  const recentOrders = [
    { id: '#ORD-5921', customer: 'Alice Freeman', status: 'Shipped', amount: '$250.00' },
    { id: '#ORD-5922', customer: 'Bob Smith', status: 'Pending', amount: '$120.50' },
    { id: '#ORD-5923', customer: 'Charlie Davis', status: 'Processing', amount: '$940.00' },
    { id: '#ORD-5924', customer: 'Diana Ross', status: 'Shipped', amount: '$45.00' },
    { id: '#ORD-5925', customer: 'Ethan Hunt', status: 'Delivered', amount: '$2,100.00' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Here's what's happening with your store today.</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 transition-colors font-medium text-sm">
              Download Report
            </button>
            <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-colors font-medium text-sm">
              New Order
            </button>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d={stat.icon}></path>
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className={`font-medium flex items-center ${stat.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stat.positive ? (
                      <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    ) : (
                      <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                    )}
                    {stat.change}
                  </span>
                  <span className="text-slate-500 ml-2">from last month</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Middle Grid (Charts & Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Monthly performance compared to last year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full flex items-end space-x-2 px-2 pb-2 pt-6">
                {/* Mocked Bar Chart */}
                {[40, 70, 45, 90, 65, 85, 100, 60, 110, 80, 120, 95].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded">
                      ${height}k
                    </div>
                    <div 
                      className="w-full bg-emerald-100 hover:bg-emerald-500 rounded-t-sm transition-colors duration-300"
                      style={{ height: `${height}%` }}
                    ></div>
                    <div className="text-[10px] text-slate-400 mt-2 rotate-45 origin-left">
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions in your store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { user: 'Olivia Martin', action: 'placed a new order', time: '2 mins ago', amount: '+$1,999.00', color: 'bg-emerald-500' },
                  { user: 'Jackson Lee', action: 'refunded order #423', time: '1 hour ago', amount: '-$45.00', color: 'bg-rose-500' },
                  { user: 'Isabella Nguyen', action: 'restocked inventory', time: '3 hours ago', amount: '120 units', color: 'bg-blue-500' },
                  { user: 'William Kim', action: 'subscribed to Pro', time: '5 hours ago', amount: '+$99.00', color: 'bg-purple-500' },
                  { user: 'Sofia Davis', action: 'placed a new order', time: 'Yesterday', amount: '+$39.00', color: 'bg-emerald-500' },
                ].map((act, i) => (
                  <div key={i} className="flex items-center">
                    <div className="relative">
                      <div className={`w-2 h-2 rounded-full ${act.color} ring-4 ring-white`}></div>
                      {i !== 4 && <div className="absolute top-3 left-1 w-0.5 h-10 bg-slate-100 -translate-x-1/2"></div>}
                    </div>
                    <div className="ml-4 flex-1 space-y-1">
                      <p className="text-sm font-medium text-slate-900">{act.user} <span className="font-normal text-slate-500">{act.action}</span></p>
                      <p className="text-xs text-slate-400">{act.time}</p>
                    </div>
                    <div className="text-sm font-medium text-slate-900">{act.amount}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid (Tables & Extras) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>You have 234 unprocessed orders.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentOrders.map((order, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{order.id}</td>
                      <td className="px-6 py-4 text-slate-600">{order.customer}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium
                          ${order.status === 'Shipped' ? 'bg-blue-50 text-blue-700' : 
                            order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' :
                            order.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-100 text-slate-700'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{order.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
              <button className="text-sm text-emerald-600 font-medium hover:text-emerald-700">View All Orders →</button>
            </div>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader>
              <CardTitle className="text-white">Inventory Alerts</CardTitle>
              <CardDescription className="text-slate-400">Items requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { item: 'Wireless Headphones V2', stock: 3, status: 'Low Stock' },
                  { item: 'Mechanical Keyboard Switch Set', stock: 0, status: 'Out of Stock' },
                  { item: 'USB-C Hub Pro', stock: 12, status: 'Restock Soon' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="font-medium text-sm">{item.item}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.stock} in stock</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium
                      ${item.stock === 0 ? 'bg-rose-500/20 text-rose-300' : 
                        item.stock < 5 ? 'bg-amber-500/20 text-amber-300' : 
                        'bg-blue-500/20 text-blue-300'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-sm font-medium">
                Manage Inventory
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

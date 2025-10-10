export function BranchAdminDashboard() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Branch Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Inventory Items</h3>
          <p className="text-3xl font-bold text-blue-600">342</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Low Stock Items</h3>
          <p className="text-3xl font-bold text-red-600">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Pending Orders</h3>
          <p className="text-3xl font-bold text-yellow-600">8</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Monthly Budget</h3>
          <p className="text-3xl font-bold text-green-600">$8.5K</p>
        </div>
      </div>
    </main>
  )
}

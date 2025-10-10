export function HeadOfficeDashboard() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Head Office Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">My Branches</h3>
          <p className="text-3xl font-bold text-blue-600">8</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Pending Approvals</h3>
          <p className="text-3xl font-bold text-yellow-600">15</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Monthly Budget</h3>
          <p className="text-3xl font-bold text-green-600">$45K</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium">Orders This Month</h3>
          <p className="text-3xl font-bold text-purple-600">127</p>
        </div>
      </div>
    </main>
  )
}

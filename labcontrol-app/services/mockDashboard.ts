export const mockDashboardData = {
  totalEnergy: 1284,
  avgTemp: 26.8,
  registeredUsers: 18,
  activeAlerts: 3,

  metrics: [
    {
      id: "1",
      machineId: "M01",
      temperature: 24,
      energyConsumption: 120,
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      machineId: "M02",
      temperature: 26,
      energyConsumption: 180,
      createdAt: new Date().toISOString(),
    },
    {
      id: "3",
      machineId: "M03",
      temperature: 28,
      energyConsumption: 240,
      createdAt: new Date().toISOString(),
    },
    {
      id: "4",
      machineId: "M04",
      temperature: 30,
      energyConsumption: 320,
      createdAt: new Date().toISOString(),
    },
    {
      id: "5",
      machineId: "M05",
      temperature: 27,
      energyConsumption: 210,
      createdAt: new Date().toISOString(),
    },
    {
      id: "6",
      machineId: "M06",
      temperature: 25,
      energyConsumption: 170,
      createdAt: new Date().toISOString(),
    },
  ],
};
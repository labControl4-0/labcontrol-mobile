import { getAuthSession } from "./auth";

const API_URL = "http://localhost:8080/api";

export async function getPlants() {
  const session = await getAuthSession();

  const response = await fetch(`${API_URL}/plants`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session!.token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar plantas");
  }

  return response.json();
}
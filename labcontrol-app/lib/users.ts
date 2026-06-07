// lib/users.ts - ATUALIZADO
import { getAuthSession } from "./auth";

const API_URL = "http://localhost:8080/api";

export async function updateUser(token: string, data: any) {
  const session = await getAuthSession();

  if (!session?.id) {
    throw new Error("Usuário não autenticado");
  }

  const response = await fetch(`${API_URL}/users/${session.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    console.log("Erro API:", text);
    throw new Error("Erro ao atualizar usuário");
  }

  return response.json();
}

export async function updateUserPhoto(token: string, photoUri: string) {
  const session = await getAuthSession();

  if (!session?.id) {
    throw new Error("Usuário não autenticado");
  }

  const formData = new FormData();
  formData.append("photo", {
    uri: photoUri,
    type: "image/jpeg",
    name: "profile.jpg",
  } as any);

  const response = await fetch(`${API_URL}/users/${session.id}/photo`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.log("Erro upload foto:", text);
    throw new Error("Erro ao atualizar foto");
  }

  return response.json();
}
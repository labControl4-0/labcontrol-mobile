import { getAuthSession } from "./auth";
import { apiFetch } from "../services/api";

async function requireUserId(): Promise<string> {
  const session = await getAuthSession();
  const userId = session?.user.id;

  if (!userId) {
    throw new Error("Usuário não autenticado");
  }

  return userId;
}

export async function updateUser(data: unknown) {
  const userId = await requireUserId();

  return apiFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateUserPhoto(photoUri: string) {
  const userId = await requireUserId();

  const formData = new FormData();
  formData.append("photo", {
    uri: photoUri,
    type: "image/jpeg",
    name: "profile.jpg",
  } as any);

  return apiFetch(`/users/${userId}/photo`, {
    method: "PUT",
    body: formData,
  });
}

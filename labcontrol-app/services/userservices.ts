import { apiFetch } from "./api";

export type CreateUserData = {
  name: string;
  email: string;
  password: string;
};

export async function createUser(data: CreateUserData) {
  return apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
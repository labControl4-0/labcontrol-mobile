import { apiFetch } from "../services/api";
import { createPlant } from "../lib/plants";

jest.mock("../services/api", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("createPlant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the plant creation DTO to the API", async () => {
    const input = {
      name: "Laboratório de automação",
      description: "Área de testes",
      scale: 1,
      widthUnits: 100,
      heightUnits: 80,
    };
    apiFetchMock.mockResolvedValue({ id: "plant-1", ...input });

    await createPlant(input);

    expect(apiFetchMock).toHaveBeenCalledWith("/plants", {
      method: "POST",
      body: JSON.stringify(input),
    });
  });
});

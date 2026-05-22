// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAllDepartmentsMock } = vi.hoisted(() => ({
  loadAllDepartmentsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/org/repository", () => ({
  loadAllDepartments: loadAllDepartmentsMock,
}));

beforeEach(() => {
  loadAllDepartmentsMock.mockReset();
});

describe("GET /api/catalog/teams", () => {
  it("returns a nested department tree from org Supabase", async () => {
    loadAllDepartmentsMock.mockResolvedValue([
      {
        id: "root-id",
        bitrix_department_id: "1",
        name: "Root",
        parent_bitrix_department_id: null,
      },
      {
        id: "child-id",
        bitrix_department_id: "2",
        name: "Child",
        parent_bitrix_department_id: "1",
      },
    ]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.kind).toBe("tree");
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0].id).toBe("root-id");
    expect(body.nodes[0].children[0].id).toBe("child-id");
  });

  it("returns a flat list when no parent links exist", async () => {
    loadAllDepartmentsMock.mockResolvedValue([
      {
        id: "solo-id",
        bitrix_department_id: "99",
        name: "Solo",
        parent_bitrix_department_id: null,
      },
    ]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.kind).toBe("flat");
    expect(body.teams).toEqual([
      { id: "solo-id", name: "Solo", isActive: true },
    ]);
  });
});

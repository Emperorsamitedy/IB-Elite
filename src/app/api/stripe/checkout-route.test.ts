import { describe, expect, it, vi, beforeEach } from "vitest";

const createSession = vi.fn(async () => ({ url: "https://stripe.test/session" }));

let maxPrice: string;

function mockModules() {
  vi.doMock("@/lib/env", () => ({
    serverEnv: {
      stripeSecretKey: "sk_test",
      stripePriceProMonthly: "price_pro_m",
      stripePriceProAnnual: "price_pro_y",
      stripePriceMaxMonthly: maxPrice,
    },
    env: { siteUrl: "https://atlas.test" },
  }));

  vi.doMock("@/lib/stripe", () => ({
    getStripe: () => ({ checkout: { sessions: { create: createSession } } }),
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    }),
  }));
}

function req(body: unknown) {
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    createSession.mockClear();
    maxPrice = "price_max_m";
    mockModules();
  });

  it("charges the Max price when the Max tier is requested", async () => {
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(req({ plan: "max", interval: "monthly" }));

    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_max_m", quantity: 1 }],
      }),
    );
  });

  // Existing callers send only an interval; they must still get Pro.
  it("defaults to Pro when no plan is given", async () => {
    const { POST } = await import("@/app/api/stripe/checkout/route");
    await POST(req({ interval: "annual" }));

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_y", quantity: 1 }],
      }),
    );
  });

  it("refuses an annual Max checkout, since Max is monthly only", async () => {
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(req({ plan: "max", interval: "annual" }));

    expect(res.status).toBe(503);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses Max checkout while no Max price is configured", async () => {
    maxPrice = "";
    vi.resetModules();
    mockModules();
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(req({ plan: "max", interval: "monthly" }));

    expect(res.status).toBe(503);
    expect(createSession).not.toHaveBeenCalled();
  });
});

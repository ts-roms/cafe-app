import { Server, Response } from "miragejs";
import { getInventory, saveInventory, getSales, addSale, getUsers, addUser, updateUser, deleteUser, type Sale, type UserRecord } from "@/lib/storage";
import { getRBACConfig, saveRBACConfig, type RBACConfig } from "@/lib/rbac";

// Create a MirageJS server that proxies to our existing localStorage-backed helpers.
// This runs in the browser only and is intended for development/demo.
export function makeServer() {
  if (typeof window === "undefined") return;
  // Prevent multiple servers in Fast Refresh
  if ((window as any).__mirage_server__) return (window as any).__mirage_server__;

  const server = new Server({
    routes() {
      this.namespace = "api";
      this.timing = 200; // small delay to show loading in UI

      // Inventory
      this.get("/inventory", () => {
        try {
          return getInventory();
        } catch (e) {
          return new Response(500, {}, { error: "Failed to load inventory" });
        }
      });

      this.put("/inventory", (_schema, request) => {
        try {
          const list = JSON.parse(request.requestBody || "[]");
          saveInventory(list);
          return { ok: true };
        } catch (e) {
          return new Response(400, {}, { error: "Bad inventory payload" });
        }
      });

      // Sales
      this.get("/sales", () => {
        try {
          return getSales();
        } catch (e) {
          return new Response(500, {}, { error: "Failed to load sales" });
        }
      });

      this.post("/sales", (_schema, request) => {
        try {
          const sale = JSON.parse(request.requestBody || "{}") as Sale;
          if (!sale || !sale.id) return new Response(400, {}, { error: "Invalid sale" });
          addSale(sale);
          return sale;
        } catch (e) {
          return new Response(400, {}, { error: "Bad sale payload" });
        }
      });

      // Users directory
      this.get("/users", () => {
        try {
          return getUsers();
        } catch (e) {
          return new Response(500, {}, { error: "Failed to load users" });
        }
      });

      this.post("/users", (_schema, request) => {
        try {
          const rec = JSON.parse(request.requestBody || "{}") as UserRecord;
          if (!rec || !rec.name) return new Response(400, {}, { error: "Invalid user" });
          if (!rec.id) rec.id = crypto.randomUUID();
          addUser(rec);
          return rec;
        } catch (e) {
          return new Response(400, {}, { error: "Bad user payload" });
        }
      });

      this.put("/users/:id", (_schema, request) => {
        try {
          const id = (request.params as any).id as string;
          const rec = JSON.parse(request.requestBody || "{}") as UserRecord;
          if (!rec || !id || rec.id !== id) return new Response(400, {}, { error: "ID mismatch" });
          updateUser(rec);
          return rec;
        } catch (e) {
          return new Response(400, {}, { error: "Bad user payload" });
        }
      });

      this.del("/users/:id", (_schema, request) => {
        try {
          const id = (request.params as any).id as string;
          if (!id) return new Response(400, {}, { error: "Missing id" });
          deleteUser(id);
          return { ok: true };
        } catch (e) {
          return new Response(400, {}, { error: "Bad request" });
        }
      });

      // RBAC config
      this.get("/rbac", () => {
        try {
          return getRBACConfig();
        } catch (e) {
          return new Response(500, {}, { error: "Failed to load RBAC" });
        }
      });

      this.put("/rbac", (_schema, request) => {
        try {
          const cfg = JSON.parse(request.requestBody || "{}") as RBACConfig;
          if (!cfg || !cfg.roles) return new Response(400, {}, { error: "Invalid RBAC config" });
          saveRBACConfig(cfg);
          return { ok: true };
        } catch (e) {
          return new Response(400, {}, { error: "Bad RBAC payload" });
        }
      });

      // Fallback handler (optional)
      this.passthrough();
    },
  });

  (window as any).__mirage_server__ = server;
  return server;
}

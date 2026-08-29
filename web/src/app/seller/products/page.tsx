"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  Eye,
  EyeOff,
  ImageIcon,
  Package,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#3B82F6)";

type ProductSort = "newest" | "oldest" | "price" | "stock" | "edited";

type SellerProduct = {
  _id: string;
  name?: string;
  price?: number;
  stock?: number;
  region?: string;
  images?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const SORT_LABEL: Record<ProductSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  price: "Price",
  stock: "Stock",
  edited: "Recently edited",
};

type OverlayState = {
  title: string;
  message?: string;
  tone?: "info" | "success" | "danger";
  actions?: { label: string; onPress: () => void; destructive?: boolean; primary?: boolean }[];
  durationMs?: number;
} | null;

function OrbLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative h-[110px] w-[110px]">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
      </div>
      <p className="text-[13px] text-[#737A86]">Loading products…</p>
    </div>
  );
}

function TopOverlay({ state, onDismiss }: { state: OverlayState; onDismiss: () => void }) {
  useEffect(() => {
    if (!state || state.actions?.length) return;
    const t = setTimeout(onDismiss, state.durationMs ?? 5000);
    return () => clearTimeout(t);
  }, [state, onDismiss]);
  if (!state) return null;
  const accent =
    state.tone === "danger" ? "bg-[#EF4444]" : state.tone === "success" ? "bg-[#00E575]" : "bg-[#3B82F6]";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3.5 pt-3">
      <div className="pointer-events-auto flex w-full max-w-lg overflow-hidden border border-white/10 bg-[#11141A] shadow-2xl">
        <span className={`w-[3px] shrink-0 ${accent}`} />
        <div className="flex-1 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{state.title}</p>
              {state.message ? <p className="mt-1 text-[12.5px] text-[#A7ADB8]">{state.message}</p> : null}
            </div>
            {!state.actions?.length ? (
              <button type="button" onClick={onDismiss} aria-label="Dismiss">
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            ) : null}
          </div>
          {state.actions?.length ? (
            <div className="mt-3 flex justify-end gap-2">
              {state.actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onDismiss();
                    requestAnimationFrame(() => a.onPress());
                  }}
                  className={`min-w-[72px] px-3.5 py-2 text-[13px] font-bold ${
                    a.destructive
                      ? "bg-[#EF4444] text-white"
                      : a.primary
                        ? "bg-[#F5F7FA] text-[#090B0F]"
                        : "border border-white/[0.07] bg-[#171B22]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SellerProductsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { formatProduct } = useMarketplace();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [configOpen, setConfigOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/seller/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) setProducts(json.data || []);
    } catch {
      /* keep */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const sorted = useMemo(() => {
    const list = [...products];
    switch (sort) {
      case "oldest":
        list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case "price":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "stock":
        list.sort((a, b) => Number(a.stock) - Number(b.stock));
        break;
      case "edited":
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime(),
        );
        break;
      default:
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return list;
  }, [products, sort]);

  const applySort = (key: ProductSort) => {
    setSort(key);
    setConfigOpen(false);
    setOverlay({ title: `Sorted by ${SORT_LABEL[key]}`, tone: "success", durationMs: 2500 });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleHide = async (id: string, isActive: boolean) => {
    const next = !isActive;
    setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, isActive: next } : p)));
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");
      const res = await fetch(`${API}/seller/products/${id}/visibility`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json();
      if (!json?.success) {
        setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, isActive } : p)));
        setOverlay({
          title: "Could not update visibility",
          message: json?.message || "Please try again.",
          tone: "danger",
        });
        return;
      }
      if (typeof json.data?.isActive === "boolean") {
        setProducts((prev) =>
          prev.map((p) => (p._id === id ? { ...p, isActive: json.data.isActive } : p)),
        );
      }
      setOverlay({
        title: next ? "Product is live" : "Product hidden",
        message: next
          ? "Buyers can see this item in the mall."
          : "Hidden from the mall. Still in your list.",
        tone: "success",
        durationMs: 2500,
      });
    } catch {
      setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, isActive } : p)));
      setOverlay({ title: "Could not update visibility", tone: "danger" });
    }
  };

  const bulkHide = async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const prev = products.map((p) => ({ ...p }));
    setProducts((list) =>
      list.map((p) => (ids.includes(p._id) ? { ...p, isActive: false } : p)),
    );
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      for (const id of ids) {
        const res = await fetch(`${API}/seller/products/${id}/visibility`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: false }),
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.message || "Hide failed");
      }
      setSelected(new Set());
      setSelectMode(false);
      setOverlay({
        title: "Products hidden",
        message: `${ids.length} item${ids.length === 1 ? "" : "s"} hidden from the mall.`,
        tone: "success",
      });
    } catch (e: unknown) {
      setProducts(prev);
      setOverlay({
        title: "Could not hide products",
        message: e instanceof Error ? e.message : "Try again.",
        tone: "danger",
      });
    }
  };

  const runDelete = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API}/seller/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts((prev) => prev.filter((p) => p._id !== id));
      setOverlay({ title: "Product deleted", tone: "success", durationMs: 2500 });
    } catch {
      setOverlay({ title: "Could not delete product", tone: "danger" });
    }
  };

  const handleDelete = (id: string, name: string) => {
    setOverlay({
      title: "Delete product?",
      message: `Remove “${name}” from your store? This can’t be undone.`,
      tone: "danger",
      actions: [
        { label: "Cancel", onPress: () => {} },
        { label: "Delete", destructive: true, onPress: () => runDelete(id) },
      ],
    });
  };

  const runBulkDelete = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const ids = [...selected];
      for (const id of ids) {
        await fetch(`${API}/seller/products/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setProducts((prev) => prev.filter((p) => !selected.has(p._id)));
      setSelected(new Set());
      setSelectMode(false);
      setOverlay({ title: "Products deleted", tone: "success" });
    } catch {
      setOverlay({ title: "Could not delete products", tone: "danger" });
    }
  };

  const bulkDelete = () => {
    if (!selected.size) return;
    setOverlay({
      title: "Delete products?",
      message: `Remove ${selected.size} product${selected.size !== 1 ? "s" : ""} from your store?`,
      tone: "danger",
      actions: [
        { label: "Cancel", onPress: () => {} },
        { label: "Delete", destructive: true, onPress: runBulkDelete },
      ],
    });
  };

  if (loading) return <OrbLoader />;

  return (
    <div className="min-h-screen">
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">My Products</h1>
          <p className="mt-0.5 text-xs text-[#737A86]">
            {products.length} product{products.length !== 1 ? "s" : ""} · {SORT_LABEL[sort]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectMode && selected.size > 0 ? (
            <>
              <button
                type="button"
                onClick={bulkHide}
                className="border border-white/[0.07] bg-[#171B22] px-2.5 py-2 text-xs font-bold"
              >
                Hide
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                className="border border-[#EF4444]/35 bg-[#EF4444]/10 px-2.5 py-2 text-xs font-bold text-[#EF4444]"
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="flex h-10 w-10 items-center justify-center border border-white/[0.07] bg-[#11141A]"
            aria-label="Options"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              fetchProducts();
            }}
            className="hidden border border-white/[0.07] bg-[#11141A] px-3 py-2 text-xs font-semibold text-[#A7ADB8] sm:inline-flex"
          >
            {refreshing ? "…" : "Refresh"}
          </button>
          <Link
            href="/seller/products/add"
            className="inline-flex items-center gap-1 px-3.5 py-2.5 text-sm font-extrabold text-[#041412]"
            style={{ backgroundImage: GRAD }}
          >
            <Plus className="h-[18px] w-[18px]" />
            Add
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        {sorted.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-16 text-center">
            <div className="mb-3.5 flex h-16 w-16 items-center justify-center border border-white/[0.07] bg-[#11141A]">
              <Package className="h-8 w-8 text-[#737A86]" />
            </div>
            <h2 className="text-[17px] font-bold">No products yet</h2>
            <p className="mt-1.5 text-[13px] text-[#737A86]">Publish your first item to the mall.</p>
            <Link
              href="/seller/products/add"
              className="mt-5 px-5 py-3 text-sm font-extrabold text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              Add product
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden border border-white/[0.07] bg-[#11141A] lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-wide text-[#737A86]">
                  <tr>
                    {selectMode ? <th className="w-12 px-4 py-3" /> : null}
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => {
                    const isSel = selected.has(item._id);
                    return (
                      <tr key={item._id} className="border-b border-white/[0.07] last:border-0">
                        {selectMode ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleSelect(item._id)}
                              className={`flex h-[22px] w-[22px] items-center justify-center border-2 ${
                                isSel ? "border-[#00E575] bg-[#00E575]" : "border-[#737A86]"
                              }`}
                            >
                              {isSel ? <Check className="h-3.5 w-3.5 text-[#090B0F]" /> : null}
                            </button>
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.images?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.images[0]} alt="" className="h-[52px] w-[52px] object-cover bg-[#171B22]" />
                            ) : (
                              <div className="flex h-[52px] w-[52px] items-center justify-center bg-[#171B22]">
                                <ImageIcon className="h-5 w-5 text-[#737A86]" />
                              </div>
                            )}
                            <span className="font-semibold">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#00E575]">
                          {formatProduct(Number(item.price) || 0, item.region)}
                        </td>
                        <td className="px-4 py-3 text-[#A7ADB8]">{item.stock}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold ${
                              item.isActive
                                ? "bg-[#00E575]/12 text-[#00E575]"
                                : "bg-[#EF4444]/12 text-[#EF4444]"
                            }`}
                          >
                            {item.isActive ? "Active" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!selectMode ? (
                            <div className="flex justify-end gap-3">
                              <button type="button" onClick={() => router.push(`/seller/products/${item._id}/performance`)} aria-label="Analytics">
                                <BarChart3 className="h-[18px] w-[18px] text-[#A7ADB8]" />
                              </button>
                              <button type="button" onClick={() => router.push(`/seller/products/${item._id}/edit`)} aria-label="Edit">
                                <Pencil className="h-[18px] w-[18px]" />
                              </button>
                              <button type="button" onClick={() => handleHide(item._id, !!item.isActive)} aria-label="Visibility">
                                {item.isActive ? (
                                  <EyeOff className="h-[18px] w-[18px] text-[#A7ADB8]" />
                                ) : (
                                  <Eye className="h-[18px] w-[18px] text-[#A7ADB8]" />
                                )}
                              </button>
                              <button type="button" onClick={() => handleDelete(item._id, item.name || "Product")} aria-label="Delete">
                                <Trash2 className="h-[18px] w-[18px] text-[#EF4444]" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-2.5 lg:hidden">
              {sorted.map((item) => {
                const isSel = selected.has(item._id);
                return (
                  <li key={item._id} className="flex items-center border border-white/[0.07] bg-[#11141A] p-3">
                    {selectMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(item._id)}
                        className={`mr-2.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 ${
                          isSel ? "border-[#00E575] bg-[#00E575]" : "border-[#737A86]"
                        }`}
                      >
                        {isSel ? <Check className="h-3.5 w-3.5 text-[#090B0F]" /> : null}
                      </button>
                    ) : null}
                    {item.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.images[0]} alt="" className="h-[72px] w-[72px] shrink-0 object-cover bg-[#171B22]" />
                    ) : (
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-[#171B22]">
                        <ImageIcon className="h-5 w-5 text-[#737A86]" />
                      </div>
                    )}
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="mt-1 text-sm font-semibold text-[#00E575]">
                        {formatProduct(Number(item.price) || 0, item.region)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[11px] text-[#737A86]">Stock {item.stock}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold ${
                            item.isActive ? "bg-[#00E575]/12 text-[#00E575]" : "bg-[#EF4444]/12 text-[#EF4444]"
                          }`}
                        >
                          {item.isActive ? "Active" : "Hidden"}
                        </span>
                      </div>
                    </div>
                    {!selectMode ? (
                      <div className="ml-2 flex flex-col gap-3.5">
                        <button type="button" onClick={() => router.push(`/seller/products/performance/${item._id}`)}>
                          <BarChart3 className="h-[19px] w-[19px] text-[#A7ADB8]" />
                        </button>
                        <button type="button" onClick={() => router.push(`/seller/products/${item._id}/edit`)}>
                          <Pencil className="h-[19px] w-[19px]" />
                        </button>
                        <button type="button" onClick={() => handleHide(item._id, !!item.isActive)}>
                          {item.isActive ? (
                            <EyeOff className="h-[19px] w-[19px] text-[#A7ADB8]" />
                          ) : (
                            <Eye className="h-[19px] w-[19px] text-[#A7ADB8]" />
                          )}
                        </button>
                        <button type="button" onClick={() => handleDelete(item._id, item.name || "Product")}>
                          <Trash2 className="h-[19px] w-[19px] text-[#EF4444]" />
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {configOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="w-full max-w-sm border-t border-white/[0.07] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-bold">Product options</h2>
              <button type="button" onClick={() => setConfigOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-[#A7ADB8]" />
              </button>
            </div>
            {(Object.keys(SORT_LABEL) as ProductSort[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applySort(key)}
                className="flex w-full items-center justify-between border-t border-white/[0.07] px-5 py-3.5 text-left text-sm font-semibold"
              >
                Sort by {SORT_LABEL[key]}
                {sort === key ? <Check className="h-4 w-4 text-[#00E575]" /> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
                setConfigOpen(false);
              }}
              className="flex w-full border-t border-white/[0.07] px-5 py-3.5 text-left text-sm font-semibold"
            >
              {selectMode ? "Done selecting" : "Select for bulk actions"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
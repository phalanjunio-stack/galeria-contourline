import AdminSidebar from "../components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EFF5FF] flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-60">
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import BottomBar from "../components/BottomBar";
import ScrollToTop from "../components/ScrollToTop";
import Footer from "../components/Footer";
import InfoModais from "../components/InfoModais";
import { ToastProvider } from "../components/ToastProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#EFF5FF]">
        <Sidebar />
        <div className="lg:ml-60 flex flex-col min-h-screen">
          <Topbar />
          <main className="flex-1 pb-24 lg:pb-0 pt-16 lg:pt-20">
            {children}
          </main>
          <Footer />
        </div>
        <BottomBar />
        <ScrollToTop />
        <InfoModais />
      </div>
    </ToastProvider>
  );
}

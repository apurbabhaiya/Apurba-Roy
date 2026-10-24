import React, { useEffect } from "react";
import RamyaChatWidget from "./components/RamyaChatWidget";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";
import PublicDeliveryAlbums from "./delivery/PublicDeliveryAlbums";
import RamyaChobiDelivery from "./delivery/RamyaChobiDelivery";
import RamyaChobiDeliveryAdmin from "./delivery/RamyaChobiDeliveryAdmin";
import RamyaChobiHome from "./home/RamyaChobiHome";
import RamyaChobiPackages from "./home/RamyaChobiPackages";
import RamyaChobiAbout from "./home/RamyaChobiAbout";
import ClientAccessPage from "./home/ClientAccessPage";
import PortfolioPage from "./home/PortfolioPage";
import AlbumGalleryPage from "./home/AlbumGalleryPage";
import FacebookAccessGate from "./home/FacebookAccessGate";

const withChat = (page: React.ReactNode) => <>{page}<RamyaChatWidget /></>;

export default function RouterApp() {
  const path = window.location.pathname;

  useEffect(() => {
    const isPublicPage = path === "/" || path === "/about" || path === "/packages" || path === "/portfolio" || path === "/stories" || path === "/blog";
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = isPublicPage ? "index,follow" : "noindex,nofollow";

    document.title =
      path === "/"
        ? "RamyaChobi · Photography & Cinematography"
        : path === "/about"
          ? "About · RamyaChobi"
          : path === "/packages"
            ? "Packages · RamyaChobi"
            : path === "/portfolio"
              ? "Portfolio · RamyaChobi"
              : path === "/stories" || path === "/blog"
                ? "Stories · RamyaChobi"
                : path === "/face-search"
            ? "Face Search · RamyaChobi"
            : path === "/client-gallery"
              ? "Client Gallery · RamyaChobi"
              : path.startsWith("/delivery-admin")
              ? "RamyaChobi · Delivery Admin"
              : path.startsWith("/delivery")
                ? "RamyaChobi · Private Client Delivery"
                : path.startsWith("/photo-selection") || path.startsWith("/gallery/") || path.startsWith("/select/")
                  ? "RamyaChobi · Photo Selection"
                  : path.startsWith("/booking")
                    ? "RamyaChobi · Booking"
                    : "RamyaChobi";
  }, [path]);

  if (path === "/facebook-login") return <FacebookAccessGate callback />;

  if (path === "/") return withChat(<RamyaChobiHome />);
  if (path === "/about") return withChat(<RamyaChobiAbout />);
  if (path === "/packages") return withChat(<RamyaChobiPackages />);
  if (path === "/portfolio") return withChat(<PortfolioPage />);
  if (path === "/stories" || path === "/blog") return withChat(<PortfolioPage featuredOnly={false} />);
  if (path === "/face-search" || path === "/client-gallery") return <FacebookAccessGate><AlbumGalleryPage /></FacebookAccessGate>;
  if (path === "/albums") return <FacebookAccessGate><AlbumGalleryPage /></FacebookAccessGate>;
  if (path.startsWith("/albums/")) return <FacebookAccessGate><AlbumGalleryPage token={decodeURIComponent(path.split("/")[2] || "")} /></FacebookAccessGate>;
  if (path.startsWith("/client-gallery/")) return <FacebookAccessGate><AlbumGalleryPage token={decodeURIComponent(path.split("/")[2] || "")} /></FacebookAccessGate>;
  if (path.startsWith("/album/")) return <FacebookAccessGate><AlbumGalleryPage token={decodeURIComponent(path.replace(/^\/album\//, "").split("/")[0] || "")} /></FacebookAccessGate>;

  if (path.startsWith("/booking")) return withChat(<BookingPortal />);

  if (path.startsWith("/delivery-admin")) return <RamyaChobiDeliveryAdmin />;
  if (path.startsWith("/photo-selection") || path.startsWith("/gallery/") || path.startsWith("/select/") || path === "/studio" || path.startsWith("/studio/")) return <LegacyApp />;
  if (path.startsWith("/delivery/album/")) return <PublicDeliveryAlbums albumId={path.split("/")[3] || ""} />;
  if (path.startsWith("/delivery/")) {
    const token = decodeURIComponent(path.replace(/^\/delivery\//, "").split("/")[0] || "");
    return <RamyaChobiDelivery token={token} />;
  }
  if (path === "/delivery") return withChat(<PublicDeliveryAlbums />);
  return withChat(<RamyaChobiHome />);
}

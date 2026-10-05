import React, { useEffect } from "react";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";
import RamyaChobiDelivery from "./delivery/RamyaChobiDelivery";
import RamyaChobiDeliveryAdmin from "./delivery/RamyaChobiDeliveryAdmin";
import RamyaChobiHome from "./home/RamyaChobiHome";
import RamyaChobiPackages from "./home/RamyaChobiPackages";
import RamyaChobiAbout from "./home/RamyaChobiAbout";
import ClientAccessPage from "./home/ClientAccessPage";
import PortfolioPage from "./home/PortfolioPage";
import AlbumGalleryPage from "./home/AlbumGalleryPage";
import GalleryFollowGatePage from "./home/GalleryFollowGatePage";

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

  if (path === "/") return <RamyaChobiHome />;
  if (path === "/about") return <RamyaChobiAbout />;
  if (path === "/packages") return <RamyaChobiPackages />;
  if (path === "/portfolio") return <PortfolioPage />;
  if (path === "/stories" || path === "/blog") return <PortfolioPage featuredOnly={false} />;
  if (path === "/face-search" || path === "/client-gallery") return <AlbumGalleryPage />;
  if (path === "/albums") return <AlbumGalleryPage />;
  if (path.startsWith("/albums/")) return <GalleryFollowGatePage token={decodeURIComponent(path.split("/")[2] || "")} />;
  if (path.startsWith("/client-gallery/")) return <AlbumGalleryPage token={decodeURIComponent(path.split("/")[2] || "")} />;
  if (path.startsWith("/album/")) return <AlbumGalleryPage token={decodeURIComponent(path.replace(/^\/album\//, "").split("/")[0] || "")} />;

  if (path.startsWith("/booking")) return <BookingPortal />;

  if (path === "/delivery-admin" || path.startsWith("/delivery-admin/")) {
    return <RamyaChobiDeliveryAdmin />;
  }

  if (
    path === "/photo-selection" ||
    path.startsWith("/photo-selection/") ||
    path.startsWith("/gallery/") ||
    path.startsWith("/select/") ||
    path === "/studio" ||
    path.startsWith("/studio/")
  ) {
    return <LegacyApp />;
  }

  if (path.startsWith("/delivery/")) {
    const token = decodeURIComponent(path.replace(/^\/delivery\//, "").split("/")[0] || "");
    return <RamyaChobiDelivery token={token} />;
  }

  if (path === "/delivery") {
    return <RamyaChobiDelivery token="demo-ramyachobi-2026" />;
  }

  return <RamyaChobiHome />;
}

import React, { useEffect } from "react";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";
import RamyaChobiDelivery from "./delivery/RamyaChobiDelivery";
import RamyaChobiDeliveryAdmin from "./delivery/RamyaChobiDeliveryAdmin";
import RamyaChobiHome from "./home/RamyaChobiHome";

export default function RouterApp() {
  const path = window.location.pathname;

  useEffect(() => {
    const isPublicHome = path === "/";
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = isPublicHome ? "index,follow" : "noindex,nofollow";

    document.title = isPublicHome
      ? "RamyaChobi · Photography & Cinematography"
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

  if (path === "/") {
    return <RamyaChobiHome />;
  }

  if (path.startsWith("/booking")) {
    return <BookingPortal />;
  }

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

import React from "react";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";
import RamyaChobiDelivery from "./delivery/RamyaChobiDelivery";
import RamyaChobiDeliveryAdmin from "./delivery/RamyaChobiDeliveryAdmin";

export default function RouterApp() {
  const path = window.location.pathname;

  // Existing RamyaChobi booking portal
  if (path.startsWith("/booking")) {
    return <BookingPortal />;
  }

  // New delivery management admin
  if (path === "/delivery-admin" || path.startsWith("/delivery-admin/")) {
    return <RamyaChobiDeliveryAdmin />;
  }

  // Existing photo-selection system. Keep all old admin and client selection flows.
  if (
    path === "/photo-selection" ||
    path.startsWith("/photo-selection/") ||
    path.startsWith("/gallery/") ||
    path.startsWith("/select/")
  ) {
    return <LegacyApp />;
  }

  // Private client delivery landing page
  if (path.startsWith("/delivery/")) {
    const token = decodeURIComponent(path.replace(/^\/delivery\//, "").split("/")[0] || "");
    return <RamyaChobiDelivery token={token} />;
  }

  // Public/demo delivery landing
  if (path === "/" || path === "/delivery") {
    return <RamyaChobiDelivery token="demo-ramyachobi-2026" />;
  }

  // Preserve legacy behavior for any existing old links not covered above.
  return <LegacyApp />;
}

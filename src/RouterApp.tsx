import React from "react";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";
import RamyaChobiDelivery from "./delivery/RamyaChobiDelivery";
import RamyaChobiDeliveryAdmin from "./delivery/RamyaChobiDeliveryAdmin";

export default function RouterApp() {
  const path = window.location.pathname;

  if (path.startsWith("/booking")) {
    return <BookingPortal />;
  }

  if (path === "/delivery-admin" || path.startsWith("/delivery-admin/")) {
    return <RamyaChobiDeliveryAdmin />;
  }

  if (path.startsWith("/delivery/")) {
    const token = decodeURIComponent(path.replace(/^\/delivery\//, "").split("/")[0] || "");
    return <RamyaChobiDelivery token={token} />;
  }

  if (path === "/" || path === "/delivery") {
    return <RamyaChobiDelivery token="demo-ramyachobi-2026" />;
  }

  return <LegacyApp />;
}

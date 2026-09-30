import React from "react";
import LegacyApp from "./App";
import BookingPortal from "./booking/BookingPortal";

export default function RouterApp() {
  if (window.location.pathname.startsWith("/booking")) {
    return <BookingPortal />;
  }
  return <LegacyApp />;
}

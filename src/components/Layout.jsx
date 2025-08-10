import React from "react";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <Navbar />
      
      {/* Spacer for fixed navbar - اینجا اضافه کردم */}
      <div className="h-16"></div>
      
      <main className="relative">
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </>
  );
}
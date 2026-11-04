import { connection } from "next/server";
import { loadRadar } from "@/lib/radar";
import { RadarApp } from "@/components/radar-app";
export default async function Home() {
  await connection();
  return <RadarApp initial={await loadRadar()} />;
}

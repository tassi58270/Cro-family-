import { ImageResponse } from "next/og";
import { shieldSrc } from "@/lib/design/share-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the arms of Croÿ on white. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      <img src={shieldSrc} width={104} height={124} alt="" />
    </div>,
    size,
  );
}

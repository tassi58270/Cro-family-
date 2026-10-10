import { notFound } from "next/navigation";

/** Sends unknown addresses inside a language to the localized 404 page. */
export default function UnknownPage() {
  notFound();
}

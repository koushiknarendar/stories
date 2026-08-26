import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getBook, getBookProgress } from "@/lib/db";
import BookReader from "@/components/BookReader";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return {};
  return {
    title: `${book.title} · Storis`,
    description: book.author ? `By ${book.author} — read in bite-sized cards on Storis` : "Read in bite-sized cards on Storis",
  };
}

export default async function BookPage({ params }: Props) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book || book.status !== "ready") notFound();

  const { userId } = await auth();
  const progress = userId ? await getBookProgress(userId, id) : null;

  return <BookReader book={book} initialCardIndex={progress?.currentCardIndex ?? 0} />;
}

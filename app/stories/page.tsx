"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { getCurrent } from "@/lib/storage";
import StoryReader from "@/components/StoryReader";
import ShortPlayer from "@/components/ShortPlayer";
import type { StorySet } from "@/lib/types";

export default function StoriesPage() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const [set, setSet] = useState<StorySet | null>(null);
  const [storySetId, setStorySetId] = useState<string | undefined>(undefined);
  const [shortSaved, setShortSaved] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    const data = getCurrent();
    if (!data) { router.replace("/"); return; }
    setSet(data);
  }, [router]);

  // Auto-save regular story sets for all users (guests get an anon save for shareability)
  useEffect(() => {
    if (!set || !isLoaded || savedRef.current) return;
    if (set.source === "youtube-short") return;
    savedRef.current = true;
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
      .then(r => r.json())
      .then(data => { if (data.id) setStorySetId(data.id); })
      .catch(() => {});
  }, [set, isLoaded]);

  async function handleSaveShort(collectionId?: string) {
    if (!set) return;
    const res = await fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    });
    const data = await res.json();
    if (collectionId) {
      await fetch(`/api/collections/${collectionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storySetId: set.id }),
      }).catch(() => {});
    }
    if (data.ok || data.id) setStorySetId(set.id);
    setShortSaved(true);
  }

  if (!set) return null;
  if (set.source === "youtube-short") {
    return <ShortPlayer set={set} storySetId={storySetId} onSave={handleSaveShort} saved={shortSaved} />;
  }
  return <StoryReader set={set} storySetId={storySetId} />;
}

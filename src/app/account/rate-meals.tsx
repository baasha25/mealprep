"use client";

import { useState, useTransition } from "react";
import { Star, Check } from "lucide-react";
import { submitReview } from "./review-actions";

export type ReviewableMeal = { id: string; name: string; rating: number; comment: string };

function Stars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => onPick(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            <Star size={20} style={{ color: on ? "#e0a53f" : "var(--line)" }} fill={on ? "#e0a53f" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

function MealRow({ meal }: { meal: ReviewableMeal }) {
  const [rating, setRating] = useState(meal.rating);
  const [comment, setComment] = useState(meal.comment);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  const save = (nextRating: number, nextComment: string) => {
    if (nextRating < 1) return;
    start(async () => {
      const r = await submitReview({ mealId: meal.id, rating: nextRating, comment: nextComment });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="flex items-center gap-3 py-3" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{meal.name}</div>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== meal.comment && save(rating, comment)}
          placeholder="Add a note (optional)"
          className="w-full mt-1 px-2 py-1 rounded-md border text-[12.5px] outline-none"
          style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
        />
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <Stars value={rating} onPick={(n) => { setRating(n); save(n, comment); }} />
        {saved && <Check size={15} style={{ color: "var(--pine)" }} />}
      </div>
    </div>
  );
}

export function RateMeals({ meals }: { meals: ReviewableMeal[] }) {
  if (meals.length === 0) {
    return <p className="text-[13px]" style={{ color: "var(--muted)" }}>Order some meals and they&apos;ll show up here to review.</p>;
  }
  return (
    <div>
      {meals.map((m) => (
        <MealRow key={m.id} meal={m} />
      ))}
    </div>
  );
}

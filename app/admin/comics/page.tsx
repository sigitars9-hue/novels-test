"use client";

import AdminGate from "@/components/admin/AdminGate";
import CreateComicForm from "@/components/admin/CreateComicForm";
import CreateChapterForm from "@/components/admin/CreateChapterForm";
import BulkImagesForm from "@/components/admin/BulkImagesForm";

export default function AdminComicsPage() {
  return (
    <AdminGate>
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">Dashboard Komik (Admin)</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <CreateComicForm />
          <CreateChapterForm />
        </div>
        <BulkImagesForm />
      </div>
    </AdminGate>
  );
}

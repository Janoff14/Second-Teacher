import { AcademicStructure } from "@/components/academic/AcademicStructure";

export default function TeacherStructurePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Structure
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Subjects, groups, and join codes for your classes.
      </p>
      <div className="mt-8">
        <AcademicStructure />
      </div>
    </div>
  );
}

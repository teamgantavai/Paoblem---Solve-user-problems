import { redirect } from 'next/navigation';

export default function ProblemSolutionsRedirect({ params }: { params: { id: string } }) {
  redirect(`/startups`);
}

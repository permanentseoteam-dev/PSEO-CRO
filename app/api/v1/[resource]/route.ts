import { handleApiGet } from "@/features/platform-p2/api/handler";

// Public read API. No session cookie: the handler checks the Bearer API key and its scope.
export async function GET(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handleApiGet(req, (await params).resource);
}

-- CreateTable
CREATE TABLE "ChatbotPendingAction" (
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotPendingAction_pkey" PRIMARY KEY ("sessionId")
);

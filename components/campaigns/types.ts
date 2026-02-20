export type StepType = "email" | "whatsapp" | "wait" | "condition";

export interface Step {
    id: string;
    type: StepType;
    title: string;
    content?: string;
    delay?: number; // hours
    condition?: {
        type: "EMAIL_OPENED" | "EMAIL_REPLIED" | "EMAIL_CLICKED" | "WAIT_TIME";
        waitHours?: number;
    };
}

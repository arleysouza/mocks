import "express";

export interface UserPayload {
  id: string;
  username: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: UserPayload;
  }
}
/* 
Certifique-se de que o tsconfig.json inclua a pasta src/types no include
*/
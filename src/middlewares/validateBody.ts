import { Request, Response, NextFunction, RequestHandler } from "express";

// Tipos aceitos para validação
type FieldType = "string" | "number" | "boolean";

// Configuração de validação de campo
interface FieldValidation {
  name: string;          // nome do campo
  required?: boolean;    // campo obrigatório
  type?: FieldType;      // tipo de dado esperado
  pattern?: RegExp;      // expressão regular para validar valor
  minLength?: number;    // tamanho mínimo (para strings)
  maxLength?: number;    // tamanho máximo (para strings)
}

// Middleware de validação de corpo da requisição
export const validateBody = (fields: FieldValidation[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const field of fields) {
      const value = req.body[field.name];

      // Verifica obrigatoriedade
      if (field.required && (value === undefined || value === null || value === "")) {
        errors.push(`Campo obrigatório: ${field.name}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        // Verifica tipo
        if (field.type && typeof value !== field.type) {
          errors.push(`Campo ${field.name} deve ser do tipo ${field.type}`);
        }

        // Verifica tamanho mínimo
        if (field.type === "string" && field.minLength && value.length < field.minLength) {
          errors.push(`Campo ${field.name} deve ter no mínimo ${field.minLength} caracteres`);
        }

        // Verifica tamanho máximo
        if (field.type === "string" && field.maxLength && value.length > field.maxLength) {
          errors.push(`Campo ${field.name} deve ter no máximo ${field.maxLength} caracteres`);
        }

        // Verifica regex
        if (field.pattern && !field.pattern.test(value)) {
          errors.push(`Campo ${field.name} não corresponde ao formato esperado`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: "Erro de validação dos campos",
        data: errors,
      });
      return;
    }

    next();
  };
}



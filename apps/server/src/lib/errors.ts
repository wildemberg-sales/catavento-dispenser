export class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super("Usuário ou senha inválidos.", 401, "INVALID_CREDENTIALS");
  }
}

export class AccountDisabledError extends DomainError {
  constructor() {
    super("Esta conta está desativada.", 403, "ACCOUNT_DISABLED");
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super("Refresh token inválido, expirado ou revogado.", 401, "INVALID_REFRESH_TOKEN");
  }
}

export class QueueItemNotFoundError extends DomainError {
  constructor() {
    super("Item de fila não encontrado.", 404, "QUEUE_ITEM_NOT_FOUND");
  }
}

export class NotYourItemError extends DomainError {
  constructor() {
    super("Este item não está atribuído a você.", 403, "NOT_YOUR_ITEM");
  }
}

export class AlreadyCompletedError extends DomainError {
  constructor() {
    super("Este item já foi concluído.", 409, "ALREADY_COMPLETED");
  }
}

export class NoFileUploadedError extends DomainError {
  constructor() {
    super("Nenhum arquivo foi enviado.", 400, "NO_FILE_UPLOADED");
  }
}

export class UnsupportedFileTypeError extends DomainError {
  constructor() {
    super("Tipo de arquivo não suportado. Envie um CSV ou XLSX.", 400, "UNSUPPORTED_FILE_TYPE");
  }
}

export class FileParseError extends DomainError {
  constructor(detail: string) {
    super(`Não foi possível ler o arquivo: ${detail}`, 400, "FILE_PARSE_ERROR");
  }
}

export class ImportBatchNotFoundError extends DomainError {
  constructor() {
    super("Lote de importação não encontrado.", 404, "IMPORT_BATCH_NOT_FOUND");
  }
}

export class AlreadyConfirmedError extends DomainError {
  constructor() {
    super("Este lote já foi confirmado.", 409, "ALREADY_CONFIRMED");
  }
}

export class InvalidRequeueStateError extends DomainError {
  constructor() {
    super("Só é possível reenfileirar itens cancelados ou com problema.", 409, "INVALID_REQUEUE_STATE");
  }
}

export class CannotCancelCompletedError extends DomainError {
  constructor() {
    super("Não é possível cancelar um item já concluído.", 409, "CANNOT_CANCEL_COMPLETED");
  }
}

export class UsernameTakenError extends DomainError {
  constructor() {
    super("Este nome de usuário já está em uso.", 409, "USERNAME_TAKEN");
  }
}

export class CannotDeactivateSelfError extends DomainError {
  constructor() {
    super("Você não pode desativar sua própria conta.", 400, "CANNOT_DEACTIVATE_SELF");
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super("Usuário não encontrado.", 404, "USER_NOT_FOUND");
  }
}

export class ProductNotFoundError extends DomainError {
  constructor() {
    super("Produto não encontrado.", 404, "PRODUCT_NOT_FOUND");
  }
}

export class DuplicateSkuError extends DomainError {
  constructor() {
    super("Já existe um produto com este SKU para esta fonte.", 409, "DUPLICATE_SKU");
  }
}

export class InvalidImageTypeError extends DomainError {
  constructor() {
    super("Tipo de arquivo de imagem não suportado. Envie JPEG, PNG ou WebP.", 400, "INVALID_IMAGE_TYPE");
  }
}

export class ImageNotFoundError extends DomainError {
  constructor() {
    super("Imagem não encontrada.", 404, "IMAGE_NOT_FOUND");
  }
}

export class TooManyImagesError extends DomainError {
  constructor() {
    super("Número máximo de imagens por produto excedido.", 409, "TOO_MANY_IMAGES");
  }
}

export class OperatorNotFoundError extends DomainError {
  constructor() {
    super("Operador não encontrado.", 404, "OPERATOR_NOT_FOUND");
  }
}

export class RangeTooLargeError extends DomainError {
  constructor(maxDays: number) {
    super(`O período consultado não pode exceder ${maxDays} dias.`, 400, "RANGE_TOO_LARGE");
  }
}

export class MissingOperatorIdError extends DomainError {
  constructor() {
    super("Informe operatorId para exportar o relatório individual.", 400, "MISSING_OPERATOR_ID");
  }
}

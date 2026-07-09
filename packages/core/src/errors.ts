export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export class NotFoundError extends DomainError {
  constructor(what: string) { super("NOT_FOUND", `${what} not found`); }
}
export class SoldOutError extends DomainError {
  constructor(id: string) { super("SOLD_OUT", `Product ${id} is no longer available`); }
}
export class DuplicateContentError extends DomainError {
  constructor(hash: string) { super("DUPLICATE_CONTENT", `Content hash ${hash} already exists`); }
}

export const CREATION_PRODUCT_REFERENCE_ROLE = "product";
export const CREATION_REFERENCE_PRODUCT_ROLE = "reference-product";

export function isCreationSubjectReferenceRole(role = "") {
  return [CREATION_PRODUCT_REFERENCE_ROLE, CREATION_REFERENCE_PRODUCT_ROLE].includes(String(role || "").trim());
}

export function isCreationReferenceProductRole(role = "") {
  return String(role || "").trim() === CREATION_REFERENCE_PRODUCT_ROLE;
}

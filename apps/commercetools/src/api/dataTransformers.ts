import { PropertyName, get } from 'lodash'
import {
  Product,
  Category,
  Hash,
  ConfigurationParameters
} from "../interfaces";

export const productTransformer = ({
  projectKey,
  locale
}: ConfigurationParameters) => (item: Hash): Product => {
  const id = get(item, ["id"], "");
  const externalLink =
    (projectKey &&
      id &&
      `https://mc.commercetools.com/${projectKey}/products/${id}/general`) ||
    "";
  return {
    id,
    image: get(item, ["masterVariant", "images", 0, "url"], ""),
    name: get(item, ["name", locale as PropertyName || "en"], ""),
    sku: get(item, ["masterVariant", "sku"], ""),
    externalLink
  };
};

export const categoryTransformer = ({
  projectKey,
  locale
}: ConfigurationParameters) => (item: Hash): Category => {
  const id = get(item, ["id"], "");
  const externalLink =
    (projectKey &&
      id &&
      `https://mc.commercetools.com/${projectKey}/categories/${id}/general`) ||
    "";
  return {
    id,
    name: get(item, ["name", locale as PropertyName], ""),
    slug: get(item, ["slug", locale as PropertyName], ""),
    isMissing: false,
    externalLink,
  };
};

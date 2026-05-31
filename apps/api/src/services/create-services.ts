import type { Context } from "hono";
import { BadRequestError } from "@journey/schemas";
import { db } from "@journey/db";

import type { AuthenticatedVariables } from "../lib/auth-helpers";
import { publishers } from "../event-bus/publishers";
import {
  createProductionServices,
  createSystemServices,
  type ServiceContainer,
  type ServiceContainerFactory,
} from "./service-container";

let serviceFactoryOverride: ServiceContainerFactory | null = null;

export function setServiceFactoryOverride(factory: ServiceContainerFactory | null): void {
  serviceFactoryOverride = factory;
}

export function clearServiceFactoryOverride(): void {
  serviceFactoryOverride = null;
}

export function createServicesForOrganization(params: { organizationId: string; userId?: string }): ServiceContainer {
  const ctx = {
    db,
    organizationId: params.organizationId,
    userId: params.userId,
    publisher: publishers,
  };

  const factory = serviceFactoryOverride ?? createProductionServices;
  return factory(ctx);
}

export function createServicesForSystem(): ServiceContainer {
  return createSystemServices({ db, publisher: publishers });
}

export function createServicesFromContext(
  c: Context<{ Variables: AuthenticatedVariables }>
): ServiceContainer {
  const organization = c.get("authOrg");
  if (!organization) {
    throw new BadRequestError("Organization required for service creation");
  }

  const user = c.get("authUser");

  return createServicesForOrganization({
    organizationId: organization.id,
    userId: user?.id,
  });
}

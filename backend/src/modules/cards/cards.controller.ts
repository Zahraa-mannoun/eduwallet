import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  cardIdParamsSchema,
  createCardSchema,
  updateCardAutoRenewSchema,
  useCardSchema,
} from './cards.schema';
import {
  createCard,
  deleteCard,
  formatExpiryMMYY,
  freezeCard,
  getCardById,
  getCards,
  setCardAutoRenewPreference,
  useCard,
} from './cards.service';

function handleCardError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in cards module');
  return reply
    .status(500)
    .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
}

function requireAuthUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
  }
  return request.authUser;
}

export async function createCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createCardSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const card = await createCard(authUser.id, parsed.data);
    return reply.status(201).send(
      successResponse({
        ...card,
        expiryFormatted: formatExpiryMMYY(card.expiry),
      })
    );
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function getCardsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const cards = await getCards(authUser.id);
    return reply.status(200).send(successResponse(cards));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function getCardByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = cardIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const card = await getCardById(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(card));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function freezeCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = cardIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const card = await freezeCard(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(card));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function updateCardAutoRenewHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateCardAutoRenewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await setCardAutoRenewPreference(authUser.id, parsed.data.cardAutoRenew);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function deleteCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = cardIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    await deleteCard(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse({ message: 'Card deleted successfully' }));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

export async function useCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = useCardSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await useCard(parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleCardError(request, reply, error);
  }
}

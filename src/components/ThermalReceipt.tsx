import React from 'react';
import { Order, WHATSAPP_DISPLAY } from '../data/products';
import { formatBRL } from './CartDrawer';

interface ThermalReceiptProps {
  order: Order | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order }) => {
  if (!order) return null;

  const formattedDate = order.createdAtMs
    ? new Date(order.createdAtMs).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

  return (
    <div className="mx-auto w-full max-w-[76mm] bg-white p-2 font-mono text-[12.5px] font-medium leading-[1.4] text-black">
      <div className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-[16px] font-bold uppercase tracking-wide">
          DELÍCIA DA ESTHER
        </p>
        <p className="text-[11px] font-semibold">BOLOS E DOCES ARTESANAIS</p>
        <p className="text-[11px]">WhatsApp: {WHATSAPP_DISPLAY}</p>
        <p className="mt-1 text-[11px] font-bold uppercase">Pedido Online — Cupom não fiscal</p>
      </div>

      <div className="border-b border-dashed border-black py-2">
        <div className="flex justify-between font-bold">
          <span>PEDIDO #{order.numeroPedido}</span>
          <span>{formattedDate}</span>
        </div>
        <p className="mt-1">
          <span className="font-bold">Cliente:</span> {order.clienteNome}
        </p>
        <p>
          <span className="font-bold">WhatsApp:</span> {order.clienteWhatsapp}
        </p>
        <p>
          <span className="font-bold">Tipo:</span>{' '}
          {order.modoEntrega === 'entrega' ? 'ENTREGA' : 'RETIRADA NO ATELIÊ'}
        </p>
        {order.modoEntrega === 'entrega' && order.endereco && (
          <p className="mt-0.5 break-words">
            <span className="font-bold">Endereço:</span> {order.endereco}
          </p>
        )}
        <p className="mt-0.5">
          <span className="font-bold">Pagamento:</span> {order.formaPagamento}
        </p>
      </div>

      <div className="border-b border-dashed border-black py-2">
        <p className="mb-1 font-bold uppercase">Itens do Pedido</p>
        <div className="space-y-1.5">
          {order.itens.map((item, idx) => (
            <div key={`${item.nome}-${idx}`}>
              <div className="flex justify-between gap-2 font-semibold">
                <span>
                  {item.quantidade}x {item.nome}
                </span>
                <span className="shrink-0">
                  {formatBRL(item.preco * item.quantidade)}
                </span>
              </div>
              <p className="pl-3 text-[11px]">
                {item.quantidade} x {formatBRL(item.preco)}
              </p>
              {item.sabor && (
                <p className="pl-3 text-[11px]">Sabor: {item.sabor}</p>
              )}
              {item.observacao && (
                <p className="pl-3 text-[11px]">Obs: {item.observacao}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {order.observacoes && (
        <div className="border-b border-dashed border-black py-2">
          <p className="font-bold uppercase">Observações Gerais:</p>
          <p className="break-words">{order.observacoes}</p>
        </div>
      )}

      <div className="border-b border-dashed border-black py-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatBRL(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>
            {order.modoEntrega === 'entrega' ? 'Taxa de entrega:' : 'Retirada:'}
          </span>
          <span>
            {order.taxaEntrega === 0 ? 'Grátis' : formatBRL(order.taxaEntrega)}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-[16px] font-bold">
          <span>TOTAL:</span>
          <span>{formatBRL(order.total)}</span>
        </div>
      </div>

      <div className="pt-2 text-center text-[11px]">
        <p className="font-semibold">Feito com amor para adoçar sua vida!</p>
        <p className="mt-0.5">Obrigado pela preferência</p>
      </div>
    </div>
  );
};

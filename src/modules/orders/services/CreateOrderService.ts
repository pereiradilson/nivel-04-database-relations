import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Customer does not exist.');
    }

    if (products.length === 0) {
      throw new AppError('No products found.');
    }

    const checkProductsExists = await this.productsRepository.findAllById(
      products,
    );

    if (checkProductsExists.length !== products.length) {
      throw new AppError('Products do not exist.');
    }

    const checkProductsQuantity = products.filter(
      product =>
        checkProductsExists.filter(
          productItem => productItem.id === product.id,
        )[0].quantity < product.quantity,
    );

    if (checkProductsQuantity.length) {
      throw new AppError('Product out of stock.');
    }

    const orderProducts = products.map(product => ({
      product_id: product.id,
      price: checkProductsExists.filter(
        productItem => productItem.id === product.id,
      )[0].price,
      quantity: product.quantity,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: orderProducts,
    });

    const { order_products } = order;

    const updateQuantityProducts = order_products.map(product => ({
      id: product.product_id,
      quantity:
        checkProductsExists.filter(
          productItem => productItem.id === product.product_id,
        )[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateQuantityProducts);

    return order;
  }
}

export default CreateOrderService;

import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid'

@Injectable()
export class ProductsService {
  private readonly logger = new Logger("ProductsService");
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) { }

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);
      return product;

    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit, offset } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      // TODO: add relations
    });
    return products;
  }

  async findOne(param: string) {
    let product: Product;

    if (isUUID(param)) { 
      product = await this.productRepository.findOneBy({ id: param });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder();
      product = await queryBuilder.where(
        "slug= :slug or UPPER(title)= :title",
        { slug: param.toLowerCase(), title: param.toUpperCase() })
        .getOne();
    }

    if (!product) {
      throw new InternalServerErrorException(`Product with '${param}' not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.preload({
      id: id,
      ...updateProductDto
    });
    try {
      if (!product) throw new NotFoundException(`Product with id '${id}' not found`);
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
    return `Product with id '${id}' removed`;
  }

  private handleDBExceptions(error: any) {
    switch (error.code) {
      case "23505":
        throw new BadRequestException(error.detail);
    }
    this.logger.error(error)
    throw new InternalServerErrorException("Error unexpected, check the server logs for more information");
  }
}

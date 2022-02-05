import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Author } from "./author.entity";
import { Rent } from "./rent.entity";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class Book {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  title!: string;

  @Field(() => Author, { nullable: true })
  @ManyToOne(() => Author, (author) => author.books, { onDelete: "CASCADE" })
  author!: Author;

  @Field()
  @Column()
  isOnLoan!: boolean;

  @Field(() => Rent, { nullable: true })
  @ManyToOne(() => Rent, { nullable: true })
  rentalData!: Rent | null;

  @Field()
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: string;
}

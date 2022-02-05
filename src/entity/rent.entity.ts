import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { Book } from "./book.entity";
import { User } from "./user.entity";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class Rent {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => Book)
  @ManyToOne(() => Book, (book) => book)
  @JoinColumn()
  book!: Book;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user)
  @JoinColumn()
  user!: User;

  // la fecha del inicio del alquiler
  @Field(() => String)
  @CreateDateColumn({ type: "date" })
  out!: string;

  // la fecha de devolución, queda nula hasta el momento de la devolución
  @Field(() => String, { nullable: true })
  @Column({ type: "date", nullable: true })
  in!: string | null;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class User {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  fullName!: string;

  @Field()
  @Column()
  email!: string;

  @Field()
  @Column()
  password!: string;

  @Field(() => Boolean, { nullable: true })
  @Column({ type: "bool", nullable: true })
  valid!: boolean | false;

  @Field()
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: string;
}

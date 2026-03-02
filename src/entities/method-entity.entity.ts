import {
  Entity as TypeOrmEntity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@TypeOrmEntity('method_entities')
export class MethodEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  methodId: string;

  @Column({ default: 'individual' })
  type: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  dob: string;

  @Column({ nullable: true })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  methodResponse: Record<string, unknown>;

  @Column({ nullable: true })
  verificationStatus: string;

  @Column({ nullable: true })
  verificationSessionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

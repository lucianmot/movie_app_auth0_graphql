import gql from 'graphql-tag';

export const typeDefs = gql`
  type Query {
    health: String
  }
`;

export const resolvers = {
  Query: {
    health: () => 'ok',
  },
};

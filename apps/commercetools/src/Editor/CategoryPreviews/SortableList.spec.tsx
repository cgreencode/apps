import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Props, SortableList } from './SortableList';
import categoryPreviews from '../../__mocks__/categoryPreviews';

const defaultProps: Props = {
  disabled: false,
  categoryPreviews,
  deleteFn: jest.fn(),
};

const renderComponent = (props: Props) => {
  return render(<SortableList {...props} />);
};

jest.mock('react-sortable-hoc', () => ({
  SortableContainer: (x: any) => x,
  SortableElement: (x: any) => x,
  SortableHandle: (x: any) => x,
}));

describe('SortableList', () => {
  afterEach(cleanup);

  it('should render successfully', async () => {
    const component = renderComponent(defaultProps);
    expect(component.container).toMatchSnapshot();
  });
});

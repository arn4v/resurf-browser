interface Props extends React.ComponentPropsWithoutRef<'svg'> {}

export function ExaAILogo(props: Props) {
  return (
    <svg {...props} height='26' viewBox='0 0 86 110' fill='none'>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M0 0H86V8.20896L49.2981 55L86 101.791V110H0V0ZM43.5408 47.4289L73.3652 8.20896H13.7164L43.5408 47.4289ZM9.67573 18.0375V50.8955H34.6623L9.67573 18.0375ZM34.6623 59.1045H9.67573V91.9625L34.6623 59.1045ZM13.7164 101.791L43.5408 62.5711L73.3652 101.791H13.7164Z'
        fill='#1F40ED'
      ></path>
    </svg>
  )
}
